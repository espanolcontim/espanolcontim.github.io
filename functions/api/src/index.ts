/**
 * Функция `api` в Yandex Cloud Functions — композиционный корень в облаке. Вызывает её
 * API Gateway на `api.espanolcontim.ru` (формат запроса 1.0, `functions/api/gateway.yaml`).
 * Переменные окружения: `BUCKET`, `EMAIL_HASH_SECRET` (тот же, что у `sync`), `SESSION_SECRET`,
 * `SMTP_USER`, `SMTP_PASSWORD`; по желанию `SITE_URL` (по умолчанию https://espanolcontim.ru)
 * и `ALLOWED_ORIGINS` через запятую (по умолчанию — `SITE_URL`).
 */
import { BucketStorage, requireEnv } from '@espanolcontim/functions-shared'
import { createApi } from './api.ts'
import { SmtpMailer } from './mailer.ts'

interface GatewayEvent {
  httpMethod: string
  /** Фактический путь запроса. */
  path: string
  headers?: Record<string, string>
  body?: string
  isBase64Encoded?: boolean
}

interface Context {
  token?: { access_token: string }
}

export const handler = async (event: GatewayEvent, context: Context) => {
  const token = context.token?.access_token
  if (!token) throw new Error('Нет context.token: у функции не указан сервисный аккаунт')
  const siteUrl = process.env.SITE_URL ?? 'https://espanolcontim.ru'
  const api = createApi({
    storage: new BucketStorage(requireEnv('BUCKET'), token),
    mailer: new SmtpMailer(requireEnv('SMTP_USER'), requireEnv('SMTP_PASSWORD')),
    now: Date.now,
    sessionSecret: requireEnv('SESSION_SECRET'),
    emailHashSecret: requireEnv('EMAIL_HASH_SECRET'),
    siteUrl,
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? siteUrl).split(',').map((s) => s.trim()),
  })

  const headers = Object.fromEntries(
    Object.entries(event.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )
  const body = !event.body
    ? ''
    : event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body
  const response = await api({ method: event.httpMethod, path: event.path, headers, body })
  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body,
    isBase64Encoded: false,
  }
}
