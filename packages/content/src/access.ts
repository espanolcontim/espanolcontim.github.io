import type { LessonAddress, Level } from './levels.ts'

export const ACCESS_VALUES = ['free', 'paid'] as const
export type Access = (typeof ACCESS_VALUES)[number]

/**
 * Части урока на сайте: выжимка, конспект, упражнения по фразам урока,
 * дополнительные материалы (с их упражнениями), проверка после урока.
 */
export const PARTS = ['summary', 'notes', 'practice', 'extras', 'quiz'] as const
export type Part = (typeof PARTS)[number]

/** Кому часть открыта бесплатно: уровень целиком или первый урок любого уровня. */
export type FreeFor = Level | 'firstOfLevel'

export type AccessRule = Access | { free: readonly FreeFor[] }

/**
 * Модель доступа — таблица из docs/SPEC.md. Меняется только здесь:
 * всё, что не попало в `free`, открыто по подписке Boosty.
 */
export const ACCESS: Record<Part, AccessRule> = {
  summary: 'free',
  notes: { free: ['A0', 'firstOfLevel'] },
  // Те же фразы, что в «Практике» полного конспекта, — открыты так же.
  practice: { free: ['A0', 'firstOfLevel'] },
  extras: { free: ['firstOfLevel'] },
  quiz: 'free',
}

/** Итоговый тест уровня. */
export const LEVEL_TEST_ACCESS: Access = 'paid'

export function partAccess(part: Part, lesson: LessonAddress): Access {
  const rule = ACCESS[part]
  if (typeof rule === 'string') return rule
  const free = rule.free.some((who) =>
    who === 'firstOfLevel' ? lesson.planLesson === 1 : who === lesson.level,
  )
  return free ? 'free' : 'paid'
}
