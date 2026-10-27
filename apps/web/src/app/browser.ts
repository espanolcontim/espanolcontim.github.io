import type { Analytics } from '../features/analytics/Analytics.ts'
import { ConsentStore } from '../features/analytics/consent.ts'
import { YandexMetrika } from '../features/analytics/YandexMetrika.ts'
import { LocalStorageProgressRepository } from '../features/review/LocalStorageProgressRepository.ts'
import type { ProgressRepository } from '../features/review/ProgressRepository.ts'
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

/** Согласие на cookie и Метрику. */
export const consent = new ConsentStore(() => globalThis.localStorage)

/** Метрика — только на адресе, для которого собран сайт (site в astro.config). */
export const analytics: Analytics = new YandexMetrika(
  METRIKA_ID,
  new URL(import.meta.env.SITE).hostname,
  () => globalThis.window,
)
