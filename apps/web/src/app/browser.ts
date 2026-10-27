import { LocalStorageProgressRepository } from '../features/review/LocalStorageProgressRepository.ts'
import type { ProgressRepository } from '../features/review/ProgressRepository.ts'

/**
 * Композиционный корень для браузера: острова и скрипты страниц берут
 * зависимости отсюда. container.ts — для сборки, в браузер его не тянем:
 * в нём весь контент.
 */

export const progress: ProgressRepository = new LocalStorageProgressRepository(
  () => globalThis.localStorage,
  () => globalThis.window,
)
