import { describe, expect, it } from 'vitest'
import { LEVEL_TEST_ACCESS, PARTS, partAccess, type Access, type Part } from './access.ts'
import type { LessonAddress } from './levels.ts'

const parts = (lesson: LessonAddress): Record<Part, Access> =>
  Object.fromEntries(PARTS.map((part) => [part, partAccess(part, lesson)])) as Record<Part, Access>

// Таблица «Модель доступа» из docs/SPEC.md, построчно.
describe('partAccess', () => {
  it('A0: всё бесплатно, кроме допматериалов', () => {
    expect(parts({ level: 'A0', planLesson: 7 })).toEqual({
      summary: 'free',
      notes: 'free',
      practice: 'free',
      extras: 'paid',
      quiz: 'free',
    })
  })

  it('A1 и выше: бесплатны только выжимка и проверка', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2'] as const) {
      expect(parts({ level, planLesson: 3 })).toEqual({
        summary: 'free',
        notes: 'paid',
        practice: 'paid',
        extras: 'paid',
        quiz: 'free',
      })
    }
  })

  it('первый урок любого уровня бесплатен целиком', () => {
    for (const level of ['A0', 'A1', 'B1'] as const) {
      expect(Object.values(parts({ level, planLesson: 1 }))).toEqual(PARTS.map(() => 'free'))
    }
  })

  it('итоговый тест уровня — по подписке', () => {
    expect(LEVEL_TEST_ACCESS).toBe('paid')
  })
})
