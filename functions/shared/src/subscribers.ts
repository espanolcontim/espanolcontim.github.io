import { createHmac } from 'node:crypto'
import { z } from 'zod'

/**
 * Кэш активных платных подписчиков и тех, кто входит без подписки (free-access.json), в
 * приватном бакете. Пишет `sync`, читает `api`: по хэшу почты — кому отправить ссылку для
 * входа, по Boosty id — открыт ли доступ. Почты в открытом виде здесь нет, имён — тоже.
 */
export const SUBSCRIBERS_KEY = 'subscribers.json'

export const CachedSubscriber = z.object({
  /** Boosty id — субъект сессии. */
  id: z.number().int(),
  /** `hashEmail` от почты из Boosty или из overrides.json; `null` — почты нет, войти нельзя. */
  emailHash: z.string().nullable(),
  /** Название уровня Boosty: доступ у всех платных уровней одинаковый, это для отчёта. */
  level: z.string(),
})
export type CachedSubscriber = z.infer<typeof CachedSubscriber>

export const SubscriberCache = z.object({
  updatedAt: z.iso.datetime(),
  subscribers: z.array(CachedSubscriber),
})
export type SubscriberCache = z.infer<typeof SubscriberCache>

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/**
 * HMAC-SHA256 с секретом `EMAIL_HASH_SECRET` (одинаковым у `sync` и `api`): без секрета
 * хэш не сверить с известными адресами перебором.
 */
export const hashEmail = (email: string, secret: string): string =>
  createHmac('sha256', secret).update(normalizeEmail(email)).digest('hex')

/**
 * Тело вызова `sync` из `api`: подписчика нет в кэше — может быть, подписался только что. В этом
 * режиме `sync` не повторяет запросы к Boosty (ученик ждёт ответа) и не обновляет токен Boosty:
 * это дело таймера, иначе два запуска разом выбили бы друг друга — refresh token одноразовый.
 */
export const LOGIN_SYNC = { mode: 'login' } as const

/** Вызов от `api`, а не таймер и не тест в консоли. Тело может прийти и строкой JSON. */
export const isLoginSync = (event: unknown): boolean => {
  let body = event
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return false
    }
  }
  return (body as { mode?: unknown } | null | undefined)?.mode === LOGIN_SYNC.mode
}
