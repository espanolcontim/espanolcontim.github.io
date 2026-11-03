import { LOGIN_SYNC } from '@espanolcontim/functions-shared'

/** Вызов функции по HTTPS. `integration=raw` — тело уходит в функцию как есть, без обёртки HTTP. */
const FUNCTIONS_URL = 'https://functions.yandexcloud.net'
/** Boosty отвечает за секунду-две. Дольше ученика не держим: письмо придёт после таймера. */
export const SYNC_TIMEOUT_MS = 10_000

/**
 * Обновить кэш подписчиков сейчас, не дожидаясь таймера: вызвать функцию `sync` от имени
 * сервисного аккаунта `api` (у него роль `functions.functionInvoker` на каталог `backend`).
 * Ответ не нужен: кэш `sync` сама пишет в бакет. Ошибка `sync` приходит как 502.
 */
export const invokeSync =
  (functionId: string, iamToken: string, fetchFn: typeof fetch = fetch) =>
  async (): Promise<void> => {
    const url = `${FUNCTIONS_URL}/${encodeURIComponent(functionId)}?integration=raw`
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${iamToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(LOGIN_SYNC),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`sync: ${res.status} ${(await res.text()).slice(0, 300)}`)
  }
