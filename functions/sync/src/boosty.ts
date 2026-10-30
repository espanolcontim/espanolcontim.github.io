import { z } from 'zod'

/**
 * Неофициальный API Boosty. Проверено 30.10.2026 на блоге espanolcontim:
 * - подписчики — `GET /v1/blog/<блог>/subscribers`, `offset` — сколько записей уже выдано;
 *   в ответе — `offset` следующей страницы, в конце приходит пустая страница;
 * - токен — `POST /oauth/token/` (как в boostylib): в ответе `access_token`, `refresh_token`
 *   и `expires_in` в секундах (30 дней); refresh token каждый раз новый, старый больше не нужен.
 */
const API = 'https://api.boosty.to'
const PAGE_SIZE = 100
/** 500 × 100 подписчиков — больше не бывает; дальше — ошибка пагинации. */
const MAX_PAGES = 500

/**
 * Токены Boosty — `boosty/auth.json` в приватном бакете. Поля — как в ключе `auth`
 * Local Storage на boosty.to, плюс `deviceId` — значение ключа `_clentId` оттуда же.
 */
export const BoostyAuth = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Когда истекает accessToken, мс. */
  expiresAt: z.number(),
  deviceId: z.string().min(1),
})
export type BoostyAuth = z.infer<typeof BoostyAuth>

/** Только нужные поля: имена, аватарки и прочее отбрасываются сразу. */
const Subscriber = z.object({
  id: z.number().int(),
  /** `""` — аккаунт создан через VK, почты нет. */
  email: z.string().nullish(),
  subscribed: z.boolean(),
  status: z.string(),
  level: z.object({ name: z.string(), price: z.number() }).nullish(),
})
export type BoostySubscriber = z.infer<typeof Subscriber>

const Page = z.object({
  data: z.array(Subscriber),
  offset: z.number().int(),
  total: z.number().int(),
})

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
})

/** 401: accessToken истёк или отозван — стоит обновить токен и попробовать ещё раз. */
export class BoostyUnauthorized extends Error {}

export class BoostyClient {
  private readonly fetch: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>

  constructor(
    fetchFn: typeof fetch = fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    this.fetch = fetchFn
    this.sleep = sleep
  }

  /** Новая пара токенов. Старый refresh token после этого недействителен — новую пару сохранить сразу. */
  async refresh(auth: BoostyAuth, now: number): Promise<BoostyAuth> {
    const res = await this.fetch(`${API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        device_id: auth.deviceId,
        device_os: 'web',
      }),
    })
    if (!res.ok) {
      throw new Error(
        `Boosty не обновил токен: ${res.status} ${(await res.text()).slice(0, 300)}. ` +
          'Токены — заново из отдельного входа в Boosty в boosty/auth.json (README, «Функция sync»)',
      )
    }
    const body = TokenResponse.parse(await res.json())
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: now + body.expires_in * 1000,
      deviceId: auth.deviceId,
    }
  }

  /** Все подписчики блога, включая бесплатных и бывших. */
  async subscribers(blog: string, accessToken: string): Promise<BoostySubscriber[]> {
    const byId = new Map<number, BoostySubscriber>()
    let offset = 0
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, offset: next } = await this.page(blog, accessToken, offset)
      if (data.length === 0) return [...byId.values()]
      for (const subscriber of data) byId.set(subscriber.id, subscriber)
      if (next <= offset) throw new Error(`Boosty: offset не растёт (${offset} → ${next})`)
      offset = next
    }
    throw new Error(`Boosty: больше ${MAX_PAGES} страниц подписчиков — пагинация сломалась?`)
  }

  private async page(blog: string, accessToken: string, offset: number) {
    const url =
      `${API}/v1/blog/${encodeURIComponent(blog)}/subscribers` +
      `?sort_by=on_time&offset=${offset}&limit=${PAGE_SIZE}&order=gt`
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (res.ok) {
        const parsed = Page.safeParse(await res.json())
        if (!parsed.success) {
          throw new Error(
            `Boosty: ответ не похож на список подписчиков: ${z.prettifyError(parsed.error)}`,
          )
        }
        return parsed.data
      }
      if (res.status === 401) throw new BoostyUnauthorized('Boosty: 401, токен недействителен')
      // 429 — Boosty просит притормозить; 5xx — временный сбой.
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await this.sleep(attempt * 5000)
        continue
      }
      throw new Error(`Boosty: ${res.status} ${(await res.text()).slice(0, 300)}`)
    }
  }
}
