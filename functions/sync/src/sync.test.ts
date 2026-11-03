import { hashEmail, MemoryStorage, SUBSCRIBERS_KEY } from '@espanolcontim/functions-shared'
import { describe, expect, it } from 'vitest'
import { BoostyClient, type BoostyAuth } from './boosty.ts'
import {
  AUTH_KEY,
  FREE_ACCESS_KEY,
  FREE_ACCESS_LEVEL,
  OVERRIDES_KEY,
  REFRESH_BEFORE_MS,
  runSync,
} from './sync.ts'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const SECRET = 'test-secret'

const paidLevel = { name: 'Практика', price: 290 }
const freeLevel = { name: 'Follower', price: 0 }

interface FakeSubscriber {
  id: number
  email: string
  subscribed: boolean
  status: string
  level: { name: string; price: number } | null
}

const sub = (id: number, extra: Partial<FakeSubscriber> = {}): FakeSubscriber => ({
  id,
  email: `user${id}@example.com`,
  subscribed: true,
  status: 'active',
  level: paidLevel,
  ...extra,
})

/** Boosty в памяти: отвечает, как настоящий (offset — сколько выдано, в конце пустая страница). */
const fakeBoosty = (options: {
  subscribers: FakeSubscriber[]
  validTokens?: string[]
  pageSize?: number
  fail?: number
  attempts?: number
}) => {
  const valid = new Set(options.validTokens ?? ['access-1'])
  const calls: string[] = []
  let issued = 1
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push(`${init?.method ?? 'GET'} ${url.pathname}`)
    if (url.pathname === '/oauth/token/') {
      const form = new URLSearchParams(String(init?.body))
      if (form.get('refresh_token') !== `refresh-${issued}` || form.get('device_id') !== 'device') {
        return new Response('{"error":"invalid_grant"}', { status: 400 })
      }
      issued++
      valid.add(`access-${issued}`)
      return Response.json({
        access_token: `access-${issued}`,
        refresh_token: `refresh-${issued}`,
        expires_in: 2592000,
      })
    }
    if (options.fail) return new Response('oops', { status: options.fail })
    const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '')
    if (!token || !valid.has(token)) return new Response('', { status: 401 })
    const offset = Number(url.searchParams.get('offset'))
    const limit = options.pageSize ?? Number(url.searchParams.get('limit'))
    const data = options.subscribers.slice(offset, offset + limit)
    return Response.json({
      data,
      offset: offset + data.length,
      limit,
      total: options.subscribers.length,
    })
  }) as typeof fetch
  const client = new BoostyClient({
    fetch: fetchFn,
    sleep: async () => {},
    ...(options.attempts ? { attempts: options.attempts } : {}),
  })
  return { client, calls }
}

const auth = (expiresAt: number): BoostyAuth => ({
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt,
  deviceId: 'device',
})

const storageWith = (files: Record<string, unknown>) => {
  const storage = new MemoryStorage()
  for (const [key, value] of Object.entries(files)) storage.files.set(key, JSON.stringify(value))
  return storage
}

const readFile = (storage: MemoryStorage, key: string) =>
  JSON.parse(storage.files.get(key) ?? 'null')

const run = (storage: MemoryStorage, client: BoostyClient, refreshToken = true) =>
  runSync({
    storage,
    boosty: client,
    blog: 'espanolcontim',
    emailHashSecret: SECRET,
    now: () => NOW,
    refreshToken,
  })

describe('runSync', () => {
  it('в кэш — только активные платные: Boosty id, хэш почты, уровень', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY) })
    const { client } = fakeBoosty({
      subscribers: [
        sub(1),
        sub(2, { level: freeLevel }),
        sub(3, { subscribed: false }),
        sub(4, { status: 'inactive' }),
        sub(5, { level: null }),
        sub(6, { email: '' }),
        sub(7, { email: '  User7@Example.COM ' }),
      ],
    })

    const report = await run(storage, client)

    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual({
      updatedAt: '2026-10-30T12:00:00.000Z',
      subscribers: [
        { id: 1, emailHash: hashEmail('user1@example.com', SECRET), level: 'Практика' },
        { id: 6, emailHash: null, level: 'Практика' },
        { id: 7, emailHash: hashEmail('user7@example.com', SECRET), level: 'Практика' },
      ],
    })
    expect(storage.files.get(SUBSCRIBERS_KEY)).not.toContain('example.com')
    expect(report).toMatchObject({ total: 7, paid: 3, withEmail: 2, refreshed: false })
  })

  it('собирает все страницы по offset из ответа', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY) })
    const subscribers = Array.from({ length: 7 }, (_, i) => sub(i + 1))
    const { client, calls } = fakeBoosty({ subscribers, pageSize: 3 })

    const report = await run(storage, client)

    expect(report.paid).toBe(7)
    // 3 + 3 + 1 и пустая страница в конце
    expect(calls.filter((c) => c.includes('/subscribers'))).toHaveLength(4)
  })

  it('почта из overrides.json — для подписчиков без почты; запись бывшего подписчика не действует', async () => {
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [OVERRIDES_KEY]: { '6': 'vk-user@example.com', '99': 'gone@example.com' },
    })
    const { client } = fakeBoosty({ subscribers: [sub(1), sub(6, { email: '' })] })

    const report = await run(storage, client)

    const cached = readFile(storage, SUBSCRIBERS_KEY).subscribers
    expect(cached).toContainEqual({
      id: 6,
      emailHash: hashEmail('vk-user@example.com', SECRET),
      level: 'Практика',
    })
    expect(cached.map((s: { id: number }) => s.id)).not.toContain(99)
    expect(report).toMatchObject({ withEmail: 2, fromOverrides: 1, unusedOverrides: 1 })
  })

  it('кривой overrides.json — понятная ошибка, кэш не тронут', async () => {
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [OVERRIDES_KEY]: { Иван: 'не почта' },
    })
    const { client } = fakeBoosty({ subscribers: [sub(1)] })

    await expect(run(storage, client)).rejects.toThrow(/overrides\.json/)
    expect(storage.files.has(SUBSCRIBERS_KEY)).toBe(false)
  })

  it('до конца токена меньше недели — обновляет и сразу сохраняет новую пару', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + REFRESH_BEFORE_MS - 1) })
    const { client, calls } = fakeBoosty({ subscribers: [sub(1)] })

    const report = await run(storage, client)

    expect(calls[0]).toBe('POST /oauth/token/')
    expect(readFile(storage, AUTH_KEY)).toEqual({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: NOW + 30 * DAY,
      deviceId: 'device',
    })
    expect(report).toMatchObject({ refreshed: true, tokenExpiresAt: '2026-11-29T12:00:00.000Z' })
  })

  it('токен ещё долго действует — не обновляет', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + REFRESH_BEFORE_MS + DAY) })
    const { client, calls } = fakeBoosty({ subscribers: [sub(1)] })

    await run(storage, client)

    expect(calls).not.toContain('POST /oauth/token/')
    expect(readFile(storage, AUTH_KEY).refreshToken).toBe('refresh-1')
  })

  it('401 при живом по сроку токене — обновляет токен и пробует ещё раз', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY) })
    const { client } = fakeBoosty({ subscribers: [sub(1)], validTokens: [] })

    const report = await run(storage, client)

    expect(report).toMatchObject({ paid: 1, refreshed: true })
    expect(readFile(storage, AUTH_KEY).refreshToken).toBe('refresh-2')
  })

  it('вызов из api — токен не обновляет, даже если до конца меньше недели', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + DAY) })
    const { client, calls } = fakeBoosty({ subscribers: [sub(1)] })

    const report = await run(storage, client, false)

    expect(calls).not.toContain('POST /oauth/token/')
    expect(report).toMatchObject({ paid: 1, refreshed: false })
    expect(readFile(storage, AUTH_KEY).refreshToken).toBe('refresh-1')
  })

  it('вызов из api, 401 — ошибка без обновления токена: обновит таймер', async () => {
    const previous = { updatedAt: '2026-10-29T12:00:00.000Z', subscribers: [] }
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY), [SUBSCRIBERS_KEY]: previous })
    const { client, calls } = fakeBoosty({ subscribers: [sub(1)], validTokens: [] })

    await expect(run(storage, client, false)).rejects.toThrow(/401/)
    expect(calls).not.toContain('POST /oauth/token/')
    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual(previous)
  })

  it('Boosty не обновил токен — ошибка, кэш и токены прежние', async () => {
    const previous = { updatedAt: '2026-10-29T12:00:00.000Z', subscribers: [] }
    const storage = storageWith({
      [AUTH_KEY]: { ...auth(NOW + DAY), refreshToken: 'revoked' },
      [SUBSCRIBERS_KEY]: previous,
    })
    const { client } = fakeBoosty({ subscribers: [sub(1)] })

    await expect(run(storage, client)).rejects.toThrow(/не обновил токен: 400/)
    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual(previous)
    expect(readFile(storage, AUTH_KEY).refreshToken).toBe('revoked')
  })

  it('Boosty сбоит — ошибка, прежний кэш остаётся', async () => {
    const previous = {
      updatedAt: '2026-10-29T12:00:00.000Z',
      subscribers: [{ id: 1, emailHash: 'abc', level: 'Практика' }],
    }
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY), [SUBSCRIBERS_KEY]: previous })
    const { client } = fakeBoosty({ subscribers: [sub(1)], fail: 502 })

    await expect(run(storage, client)).rejects.toThrow(/Boosty: 502/)
    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual(previous)
  })

  it('на 429 и 5xx — три попытки; с attempts: 1 (из api) — одна', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY) })
    const retried = fakeBoosty({ subscribers: [sub(1)], fail: 429 })
    const once = fakeBoosty({ subscribers: [sub(1)], fail: 429, attempts: 1 })

    await expect(run(storage, retried.client)).rejects.toThrow(/Boosty: 429/)
    await expect(run(storage, once.client)).rejects.toThrow(/Boosty: 429/)
    expect(retried.calls).toHaveLength(3)
    expect(once.calls).toHaveLength(1)
  })

  it('был список, а стал пустым — не перезаписывает кэш', async () => {
    const previous = {
      updatedAt: '2026-10-29T12:00:00.000Z',
      subscribers: [{ id: 1, emailHash: 'abc', level: 'Практика' }],
    }
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY), [SUBSCRIBERS_KEY]: previous })
    const { client } = fakeBoosty({ subscribers: [sub(1, { level: freeLevel })] })

    await expect(run(storage, client)).rejects.toThrow(/0 активных платных/)
    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual(previous)
  })

  it('пустой список без прежнего кэша — пишет пустой кэш (платных подписчиков ещё нет)', async () => {
    const storage = storageWith({ [AUTH_KEY]: auth(NOW + 20 * DAY) })
    const { client } = fakeBoosty({ subscribers: [sub(1, { level: freeLevel })] })

    const report = await run(storage, client)

    expect(report.paid).toBe(0)
    expect(readFile(storage, SUBSCRIBERS_KEY).subscribers).toEqual([])
  })

  it('free-access.json даёт вход без подписки; платный остаётся платным', async () => {
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [FREE_ACCESS_KEY]: { '1': 'other@example.com', '100': 'Tester@Example.com' },
    })
    const { client } = fakeBoosty({ subscribers: [sub(1), sub(2, { level: freeLevel })] })

    const report = await run(storage, client)

    expect(readFile(storage, SUBSCRIBERS_KEY).subscribers).toEqual([
      { id: 1, emailHash: hashEmail('user1@example.com', SECRET), level: 'Практика' },
      { id: 100, emailHash: hashEmail('tester@example.com', SECRET), level: FREE_ACCESS_LEVEL },
    ])
    expect(storage.files.get(SUBSCRIBERS_KEY)).not.toContain('example.com')
    expect(report).toMatchObject({ paid: 1, freeAccess: 1 })
  })

  it('free-access.json не прячет сбой Boosty: платные пропали — кэш не перезаписан', async () => {
    const previous = {
      updatedAt: '2026-10-29T12:00:00.000Z',
      subscribers: [{ id: 1, emailHash: 'abc', level: 'Практика' }],
    }
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [SUBSCRIBERS_KEY]: previous,
      [FREE_ACCESS_KEY]: { '100': 'tester@example.com' },
    })
    const { client } = fakeBoosty({ subscribers: [] })

    await expect(run(storage, client)).rejects.toThrow(/0 активных платных/)
    expect(readFile(storage, SUBSCRIBERS_KEY)).toEqual(previous)
  })

  it('убрали запись из free-access.json — доступ закрылся, хотя платных нет', async () => {
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [SUBSCRIBERS_KEY]: {
        updatedAt: '2026-10-29T12:00:00.000Z',
        subscribers: [{ id: 100, emailHash: 'abc', level: FREE_ACCESS_LEVEL }],
      },
    })
    const { client } = fakeBoosty({ subscribers: [] })

    const report = await run(storage, client)

    expect(report).toMatchObject({ paid: 0, freeAccess: 0 })
    expect(readFile(storage, SUBSCRIBERS_KEY).subscribers).toEqual([])
  })

  it('кривой free-access.json — понятная ошибка, кэш не тронут', async () => {
    const storage = storageWith({
      [AUTH_KEY]: auth(NOW + 20 * DAY),
      [FREE_ACCESS_KEY]: { tester: 'не почта' },
    })
    const { client } = fakeBoosty({ subscribers: [sub(1)] })

    await expect(run(storage, client)).rejects.toThrow(/free-access\.json/)
    expect(storage.files.has(SUBSCRIBERS_KEY)).toBe(false)
  })

  it('нет токенов в бакете — понятная ошибка', async () => {
    const { client } = fakeBoosty({ subscribers: [] })
    await expect(run(new MemoryStorage(), client)).rejects.toThrow(/нет boosty\/auth\.json/)
  })
})
