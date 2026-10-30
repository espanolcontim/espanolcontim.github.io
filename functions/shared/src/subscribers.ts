import { createHmac } from 'node:crypto'
import { z } from 'zod'

/**
 * Кэш активных платных подписчиков в приватном бакете. Пишет `sync`, читает `api`:
 * по хэшу почты — кому отправить ссылку для входа, по Boosty id — открыт ли доступ.
 * Почты в открытом виде здесь нет, имён — тоже.
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
