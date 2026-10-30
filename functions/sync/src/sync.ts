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
  BoostyAuth,
  BoostyUnauthorized,
  type BoostyClient,
  type BoostySubscriber,
} from './boosty.ts'

export const AUTH_KEY = 'boosty/auth.json'
export const OVERRIDES_KEY = 'overrides.json'

/** Обновлять токен, когда до конца осталось меньше недели: живёт он 30 дней, `sync` — раз в час. */
export const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * `overrides.json` — почта для подписчиков, у которых её нет в Boosty (аккаунт через VK):
 * `{ "<Boosty id>": "почта" }`. Тимур дописывает вручную после сообщения в личку на Boosty.
 * Доступа сама запись не даёт: она действует, только пока подписчик — активный платный.
 */
const Overrides = z.record(z.string().regex(/^\d+$/, 'ключ — Boosty id цифрами'), z.email())

export interface SyncDeps {
  storage: Storage
  boosty: BoostyClient
  /** Имя блога: boosty.to/<вот_это>. */
  blog: string
  emailHashSecret: string
  now: () => number
}

/** Что сделал `sync` — в логи. Только числа: ни почты, ни имён, ни id. */
export interface SyncReport {
  /** Всего записей у Boosty, включая бесплатных и бывших. */
  total: number
  /** Активные платные — они в кэше. */
  paid: number
  /** Из них с почтой — могут войти. */
  withEmail: number
  /** Из них почта из overrides.json. */
  fromOverrides: number
  /** Записи overrides.json, чей подписчик сейчас не активный платный. */
  unusedOverrides: number
  /** Обновлялся ли токен Boosty. */
  refreshed: boolean
  tokenExpiresAt: string
}

/** Платные — уровень дороже нуля; активные — подписка оформлена и статус `active`. */
export const isActivePaid = (s: BoostySubscriber): boolean =>
  (s.level?.price ?? 0) > 0 && s.subscribed && s.status === 'active'

/**
 * Выгрузить подписчиков Boosty и записать кэш активных платных. Кэш пишется только после
 * полной выгрузки: при любой ошибке остаётся прежний, и вход у подписчиков не ломается.
 */
export async function runSync(deps: SyncDeps): Promise<SyncReport> {
  const { storage, boosty, now } = deps

  let auth = await readJson(storage, AUTH_KEY, BoostyAuth)
  if (!auth) {
    throw new Error(`В бакете нет ${AUTH_KEY} — положите токены Boosty (README, «Функция sync»)`)
  }

  let refreshed = false
  const refresh = async (current: BoostyAuth): Promise<BoostyAuth> => {
    const next = await boosty.refresh(current, now())
    // Сразу: старый refresh token уже недействителен, без записи токены потеряются.
    await writeJson(storage, AUTH_KEY, next)
    refreshed = true
    return next
  }

  if (auth.expiresAt - now() < REFRESH_BEFORE_MS) auth = await refresh(auth)

  let all: BoostySubscriber[]
  try {
    all = await boosty.subscribers(deps.blog, auth.accessToken)
  } catch (error) {
    if (!(error instanceof BoostyUnauthorized) || refreshed) throw error
    auth = await refresh(auth)
    all = await boosty.subscribers(deps.blog, auth.accessToken)
  }

  const overrides = (await readJson(storage, OVERRIDES_KEY, Overrides)) ?? {}
  const paid = all.filter(isActivePaid)
  let fromOverrides = 0
  const subscribers: CachedSubscriber[] = paid.map((s) => {
    const override = overrides[String(s.id)]
    if (override) fromOverrides++
    const email = override ?? (s.email?.includes('@') ? s.email : undefined)
    return {
      id: s.id,
      emailHash: email ? hashEmail(email, deps.emailHashSecret) : null,
      level: s.level?.name ?? '',
    }
  })

  // Был список, а стал пустым — скорее Boosty поменял ответ, чем ушли все подписчики сразу.
  const previous = await readJson(storage, SUBSCRIBERS_KEY, SubscriberCache)
  if (subscribers.length === 0 && previous && previous.subscribers.length > 0) {
    throw new Error(
      `Boosty вернул 0 активных платных подписчиков, а в кэше ${previous.subscribers.length} — ` +
        `кэш не перезаписан. Если подписчиков правда нет, удалите ${SUBSCRIBERS_KEY} из бакета`,
    )
  }

  const cache: SubscriberCache = { updatedAt: new Date(now()).toISOString(), subscribers }
  await writeJson(storage, SUBSCRIBERS_KEY, cache)

  const paidIds = new Set(paid.map((s) => String(s.id)))
  return {
    total: all.length,
    paid: subscribers.length,
    withEmail: subscribers.filter((s) => s.emailHash !== null).length,
    fromOverrides,
    unusedOverrides: Object.keys(overrides).filter((id) => !paidIds.has(id)).length,
    refreshed,
    tokenExpiresAt: new Date(auth.expiresAt).toISOString(),
  }
}
