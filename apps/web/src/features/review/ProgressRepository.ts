import type { Progress } from './progress.ts'

/**
 * Прогресс ученика. Сейчас — в браузере (LocalStorageProgressRepository);
 * позже, возможно, на сервере. Компоненты не знают, где он лежит.
 */
export interface ProgressRepository {
  /** Можно ли сохранять: в приватном режиме браузер может не дать. */
  available(): boolean
  /** Прогресс; если сохранить нечего или нельзя — пустой. */
  load(): Progress
  save(progress: Progress): void
  /** Прогресс изменился — в этой вкладке или в другой. Возвращает отписку. */
  subscribe(listener: () => void): () => void
}
