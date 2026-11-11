import type { LessonBody, LessonMeta } from '@espanolcontim/content'

/**
 * Доступ к урокам. Компоненты не знают, откуда пришли данные: бесплатные
 * части лежат в content/public (StaticLessonRepository), платные приходят
 * через API (ApiLessonRepository).
 */
export interface LessonRepository {
  /** Все уроки в порядке курса: практика — сразу после урока, который она закрывает. */
  list(): Promise<LessonMeta[]>
  getMeta(id: string): Promise<LessonMeta | undefined>
  /** Тело урока — те части, что доступны этому репозиторию. */
  getBody(id: string): Promise<LessonBody | undefined>
}
