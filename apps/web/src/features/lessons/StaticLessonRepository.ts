import {
  ContentIndexSchema,
  LessonBodySchema,
  type LessonBody,
  type LessonMeta,
} from '@espanolcontim/content'
import type { LessonRepository } from './LessonRepository.ts'

/**
 * Бесплатные части уроков из content/public — читаются при сборке сайта.
 * Данные проверяются схемой: битый файл ломает сборку, а не страницу.
 */
export class StaticLessonRepository implements LessonRepository {
  private readonly lessons: LessonMeta[]
  private readonly bodies: Map<string, LessonBody>

  /**
   * @param index содержимое content/public/index.json
   * @param bodies содержимое content/public/lessons/*.json
   */
  constructor(index: unknown, bodies: unknown[]) {
    this.lessons = ContentIndexSchema.parse(index).lessons.toSorted((a, b) => a.number - b.number)
    this.bodies = new Map(
      bodies.map((raw) => {
        const body = LessonBodySchema.parse(raw)
        return [body.id, body]
      }),
    )
  }

  async list(): Promise<LessonMeta[]> {
    return this.lessons
  }

  async getMeta(id: string): Promise<LessonMeta | undefined> {
    return this.lessons.find((lesson) => lesson.id === id)
  }

  async getBody(id: string): Promise<LessonBody | undefined> {
    return this.bodies.get(id)
  }
}
