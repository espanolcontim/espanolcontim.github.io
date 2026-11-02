import type { Analytics } from '../features/analytics/Analytics.ts'
import { ConsentStore } from '../features/analytics/consent.ts'
import { YandexMetrika } from '../features/analytics/YandexMetrika.ts'
import { ApiAuthService } from '../features/auth/ApiAuthService.ts'
import type { AuthService } from '../features/auth/AuthService.ts'
import { ApiLessonRepository } from '../features/lessons/ApiLessonRepository.ts'
import { LocalStorageProgressRepository } from '../features/review/LocalStorageProgressRepository.ts'
import type { ProgressRepository } from '../features/review/ProgressRepository.ts'
import { ApiClient } from '../shared/ApiClient.ts'
import { METRIKA_ID } from './analytics.ts'

/**
 * Композиционный корень для браузера: острова и скрипты страниц берут
 * зависимости отсюда. container.ts — для сборки, в браузер его не тянем:
 * в нём весь контент.
 */

export const progress: ProgressRepository = new LocalStorageProgressRepository(
  () => globalThis.localStorage,
  () => globalThis.window,
)

/** API: при `npm run dev` — `npm run api:local`, другой адрес — PUBLIC_API_URL при сборке. */
const api = new ApiClient(
  import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? 'http://localhost:8787' : 'https://api.espanolcontim.ru'),
  (...args) => globalThis.fetch(...args),
)

/** Вход подписчика и его сессия. */
export const auth: AuthService = new ApiAuthService(
  api,
  () => globalThis.localStorage,
  () => globalThis.window,
  Date.now,
)

/** Платные части уроков. */
export const paidLessons = new ApiLessonRepository(api, auth)

/** Согласие на cookie и Метрику. */
export const consent = new ConsentStore(() => globalThis.localStorage)

/** Метрика — только на адресе, для которого собран сайт (site в astro.config). */
export const analytics: Analytics = new YandexMetrika(
  METRIKA_ID,
  new URL(import.meta.env.SITE).hostname,
  () => globalThis.window,
)
