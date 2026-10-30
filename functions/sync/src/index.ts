/**
 * Функция `sync` в Yandex Cloud Functions — композиционный корень в облаке.
 * Запускается таймером раз в час. Переменные окружения: `BUCKET` — приватный бакет,
 * `BOOSTY_BLOG`, `EMAIL_HASH_SECRET` (тот же, что у `api`). Доступ к бакету — через
 * сервисный аккаунт функции: его IAM-токен приходит в `context.token`.
 */
import { BucketStorage, requireEnv } from '@espanolcontim/functions-shared'
import { BoostyClient } from './boosty.ts'
import { runSync } from './sync.ts'

interface Context {
  token?: { access_token: string }
}

export const handler = async (_event: unknown, context: Context) => {
  const token = context.token?.access_token
  if (!token) throw new Error('Нет context.token: у функции не указан сервисный аккаунт')
  const report = await runSync({
    storage: new BucketStorage(requireEnv('BUCKET'), token),
    boosty: new BoostyClient(),
    blog: requireEnv('BOOSTY_BLOG'),
    emailHashSecret: requireEnv('EMAIL_HASH_SECRET'),
    now: Date.now,
  })
  // Одна строка JSON — в Cloud Logging она разбирается на поля.
  console.log(JSON.stringify({ message: 'sync', ...report }))
  return report
}
