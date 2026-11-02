import type { LessonBody } from '@espanolcontim/content'
import { describe, expect, it } from 'vitest'
import { ApiClient, ApiFailure } from '../../shared/ApiClient.ts'
import { ApiLessonRepository } from '../lessons/ApiLessonRepository.ts'
import { ApiAuthService, RETURN_KEY, SESSION_KEY } from './ApiAuthService.ts'
import { AFTER_LOGIN, loginPath, safeReturnPath } from './navigation.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-11-02T12:00:00Z')
const iso = (time: number) => new Date(time).toISOString()

const memoryStorage = (): Storage => {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    key: (i) => [...items.keys()][i] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

/** API с заготовленными ответами: запоминает запросы, отвечает по очереди. */
function setup(...responses: (Response | Error)[]) {
  const requests: { url: string; init: RequestInit }[] = []
  const api = new ApiClient('https://api.test', async (url, init) => {
    requests.push({ url: String(url), init: init ?? {} })
    const next = responses.shift()
    if (!next) throw new Error('лишний запрос')
    if (next instanceof Error) throw next
    return next
  })
  const storage = memoryStorage()
  const events = new EventTarget()
  let now = NOW
  const auth = new ApiAuthService(
    api,
    () => storage,
    () => events,
    () => now,
  )
  return {
    api,
    auth,
    storage,
    requests,
    setNow: (time: number) => {
      now = time
    },
  }
}

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status })
const session = (token: string, left: number) => ({ token, expiresAt: iso(NOW + left) })

describe('ApiClient', () => {
  it('нет ответа — network, ошибка API — её код, непонятный ответ — internal', async () => {
    const { api } = setup(
      new Error('нет сети'),
      json(403, { error: 'not_subscribed' }),
      new Response('<html>Bad Gateway</html>', { status: 502 }),
    )
    const code = (promise: Promise<unknown>) => promise.catch((failure: ApiFailure) => failure.code)
    expect(await code(api.request('GET', '/a'))).toBe('network')
    expect(await code(api.request('GET', '/a'))).toBe('not_subscribed')
    expect(await code(api.request('GET', '/a'))).toBe('internal')
  })

  it('сессия — в Authorization, тело — JSON', async () => {
    const { api, requests } = setup(json(200, { ok: true }))
    await api.request('POST', '/a', { token: 't', body: { x: 1 } })
    const [request] = requests
    expect(request?.url).toBe('https://api.test/a')
    expect(request?.init.headers).toEqual({
      Authorization: 'Bearer t',
      'Content-Type': 'application/json',
    })
    expect(request?.init.body).toBe('{"x":1}')
  })
})

describe('вход', () => {
  it('ссылка → сессия и возврат на страницу, с которой пошли входить', async () => {
    const { auth, storage, requests } = setup(
      json(200, { ok: true }),
      json(200, session('s1', 90 * DAY)),
    )
    await auth.requestLink('a@b.ru', '/lessons/a0-02/extras/')
    expect(requests[0]?.url).toBe('https://api.test/auth/request')
    expect(requests[0]?.init.body).toBe('{"email":"a@b.ru"}')
    expect(auth.session()).toBeUndefined()

    expect(await auth.signIn('login-token')).toBe('/lessons/a0-02/extras/')
    expect(requests[1]?.url).toBe('https://api.test/auth/verify')
    expect(requests[1]?.init.body).toBe('{"token":"login-token"}')
    expect(auth.session()?.token).toBe('s1')
    expect(storage.getItem(RETURN_KEY)).toBeNull()
  })

  it('без страницы возврата — к урокам', async () => {
    const { auth } = setup(json(200, session('s1', 90 * DAY)))
    expect(await auth.signIn('login-token')).toBe(AFTER_LOGIN)
  })

  it('письмо не ушло — ошибка, страница возврата не запоминается', async () => {
    const { auth, storage } = setup(json(502, { error: 'mail_failed' }))
    await expect(auth.requestLink('a@b.ru', '/x/')).rejects.toMatchObject({ code: 'mail_failed' })
    expect(storage.getItem(RETURN_KEY)).toBeNull()
  })

  it('плохая ссылка — ошибка, сессии нет', async () => {
    const { auth } = setup(json(401, { error: 'invalid_token' }))
    await expect(auth.signIn('bad')).rejects.toMatchObject({ code: 'invalid_token' })
    expect(auth.session()).toBeUndefined()
  })

  it('выход и просрочка убирают сессию', async () => {
    const { auth, setNow } = setup(json(200, session('s1', 90 * DAY)))
    await auth.signIn('t')
    setNow(NOW + 91 * DAY)
    expect(auth.session()).toBeUndefined()
    setNow(NOW)
    expect(auth.session()).toBeDefined()
    auth.signOut()
    expect(auth.session()).toBeUndefined()
  })

  it('сообщает о входе и выходе', async () => {
    const { auth } = setup(json(200, session('s1', 90 * DAY)))
    let calls = 0
    const stop = auth.subscribe(() => calls++)
    await auth.signIn('t')
    auth.signOut()
    expect(calls).toBe(2)
    stop()
    auth.signOut()
    expect(calls).toBe(2)
  })

  it('битая запись в хранилище — как нет сессии', () => {
    const { auth, storage } = setup()
    storage.setItem(SESSION_KEY, '{нет')
    expect(auth.session()).toBeUndefined()
    storage.setItem(SESSION_KEY, '{"token":1}')
    expect(auth.session()).toBeUndefined()
  })

  it('без хранилища сайт не падает, а вход недоступен', async () => {
    const events = new EventTarget()
    const broken = () => {
      throw new Error('запрещено')
    }
    const api = new ApiClient('https://api.test', async () => json(200, session('s', DAY)))
    const auth = new ApiAuthService(api, broken, () => events, Date.now)
    expect(auth.available()).toBe(false)
    expect(auth.session()).toBeUndefined()
    await expect(auth.signIn('t')).resolves.toBe(AFTER_LOGIN)
    expect(() => auth.signOut()).not.toThrow()
  })
})

describe('продление', () => {
  const signedIn = async (left: number, ...responses: (Response | Error)[]) => {
    const context = setup(json(200, session('old', left)), ...responses)
    await context.auth.signIn('t')
    return context
  }

  it('сессия моложе недели — запроса нет', async () => {
    const { auth, requests } = await signedIn(84 * DAY)
    await auth.renew()
    expect(requests).toHaveLength(1)
  })

  it('старше недели — новая сессия', async () => {
    const { auth, requests } = await signedIn(82 * DAY, json(200, session('new', 90 * DAY)))
    await auth.renew()
    expect(requests[1]?.url).toBe('https://api.test/auth/refresh')
    expect(requests[1]?.init.headers).toEqual({ Authorization: 'Bearer old' })
    expect(auth.session()?.token).toBe('new')
  })

  it('сессия недействительна — выход', async () => {
    const { auth } = await signedIn(82 * DAY, json(401, { error: 'invalid_token' }))
    await auth.renew()
    expect(auth.session()).toBeUndefined()
  })

  it('подписка кончилась или нет сети — сессия остаётся, следующая попытка через сутки', async () => {
    const { auth, requests, setNow } = await signedIn(
      82 * DAY,
      json(403, { error: 'not_subscribed' }),
      new Error('нет сети'),
    )
    await auth.renew()
    expect(auth.session()?.token).toBe('old')
    await auth.renew()
    expect(requests).toHaveLength(2)

    setNow(NOW + DAY + 1)
    await auth.renew()
    expect(requests).toHaveLength(3)
    expect(auth.session()?.token).toBe('old')
  })
})

describe('ApiLessonRepository', () => {
  const body: LessonBody = { id: 'a0-02', sentences: [] }

  const repository = async (...responses: Response[]) => {
    const context = setup(json(200, session('s1', 90 * DAY)), ...responses)
    await context.auth.signIn('t')
    return { ...context, lessons: new ApiLessonRepository(context.api, context.auth) }
  }

  it('отдаёт платную половину по сессии', async () => {
    const { lessons, requests } = await repository(json(200, body))
    expect(await lessons.getBody('a0-02')).toEqual(body)
    expect(requests[1]?.url).toBe('https://api.test/lessons/a0-02/body')
    expect(requests[1]?.init.headers).toEqual({ Authorization: 'Bearer s1' })
  })

  it('нет файла — undefined', async () => {
    const { lessons } = await repository(json(404, { error: 'not_found' }))
    expect(await lessons.getBody('a0-02')).toBeUndefined()
  })

  it('сессия недействительна — выход и ошибка', async () => {
    const { lessons, auth } = await repository(json(401, { error: 'invalid_token' }))
    await expect(lessons.getBody('a0-02')).rejects.toMatchObject({ code: 'invalid_token' })
    expect(auth.session()).toBeUndefined()
  })

  it('подписка кончилась — ошибка, сессия остаётся', async () => {
    const { lessons, auth } = await repository(json(403, { error: 'not_subscribed' }))
    await expect(lessons.getBody('a0-02')).rejects.toMatchObject({ code: 'not_subscribed' })
    expect(auth.session()).toBeDefined()
  })

  it('без сессии в сеть не идёт', async () => {
    const { api, auth, requests } = setup()
    const lessons = new ApiLessonRepository(api, auth)
    await expect(lessons.getBody('a0-02')).rejects.toBeInstanceOf(ApiFailure)
    expect(requests).toHaveLength(0)
  })

  it('id кодируется в адресе', async () => {
    const { lessons, requests } = await repository(json(404, { error: 'not_found' }))
    await lessons.getBody('../subscribers')
    expect(requests[1]?.url).toBe('https://api.test/lessons/..%2Fsubscribers/body')
  })
})

describe('страница возврата', () => {
  it('своя страница проходит, с адресом и якорем', () => {
    expect(safeReturnPath('/lessons/a0-02/extras/')).toBe('/lessons/a0-02/extras/')
    expect(safeReturnPath('/lessons/a0-02/practice/?a=1#x1')).toBe(
      '/lessons/a0-02/practice/?a=1#x1',
    )
  })

  it.each(['https://evil.example/', '//evil.example/', '/\\evil.example/', 'javascript:alert(1)'])(
    'на чужой адрес не уводит: %s',
    (raw) => {
      expect(safeReturnPath(raw)).toBe(AFTER_LOGIN)
    },
  )

  it('пусто или сама страница входа — к урокам', () => {
    expect(safeReturnPath(null)).toBe(AFTER_LOGIN)
    expect(safeReturnPath('')).toBe(AFTER_LOGIN)
    expect(safeReturnPath('/login/')).toBe(AFTER_LOGIN)
    expect(safeReturnPath('/login/?from=/x/')).toBe(AFTER_LOGIN)
  })

  it('адрес входа кодирует страницу возврата', () => {
    expect(loginPath()).toBe('/login/')
    expect(loginPath('/lessons/a0-02/?a=1')).toBe('/login/?from=%2Flessons%2Fa0-02%2F%3Fa%3D1')
  })
})
